import io
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from app.config import OPENAI_MODEL
from app.rag import _get_client
from app.hybrid_search import _get_embeddings

def extract_text(file_content: bytes, filename: str, content_type: str) -> str:
    """Extract text from TXT or PDF bytes."""
    if filename.lower().endswith(".txt") or content_type == "text/plain":
        return file_content.decode("utf-8", errors="replace")
    elif filename.lower().endswith(".pdf") or content_type == "application/pdf":
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text
    else:
        raise ValueError("Unsupported file type. Please upload a PDF or TXT file.")

def analyze_case_file(file_content: bytes, filename: str, content_type: str, query: str) -> dict:
    """
    Stateless RAG: parses file, chunks it, builds an ephemeral vector index,
    queries it, asks LLM, and returns the result. Completely in-memory.
    """
    text = extract_text(file_content, filename, content_type)
    
    if not text.strip():
        raise ValueError("The uploaded file appears to be empty or contains no extractable text.")

    # 1. Chunk the document
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=200)
    chunks = splitter.split_text(text)
    docs = [Document(page_content=c) for c in chunks]

    # 2. Ephemeral vector store
    import chromadb
    from langchain_community.vectorstores import Chroma

    client = chromadb.EphemeralClient()
    collection_name = "ephemeral_case"
    
    embeddings = _get_embeddings()
    store = Chroma.from_documents(
        docs, 
        embeddings, 
        client=client, 
        collection_name=collection_name
    )

    # 3. Retrieve
    top_docs = store.similarity_search(query, k=5)
    
    if not top_docs:
        return {"answer": "Could not find any relevant information in the uploaded file.", "sources": []}

    context_parts = []
    sources = []
    
    # We only return 1 source chip for the File itself to save frontend clutter
    sources.append({
        "title": filename,
        "source_type": "case"
    })

    for i, doc in enumerate(top_docs, 1):
        context_parts.append(f"Excerpt {i}:\n{doc.page_content}")
        
    context_str = "\n\n---\n\n".join(context_parts)

    system_prompt = """You are Jolly LLB, an AI Legal Assistant. Your current task is to analyze a user-uploaded case file or legal document.
You must answer the user's query EXCLUSIVELY using the provided document excerpts.
Do not invent information or bring in outside laws unless explicitly mentioned in the text.
If the document does not contain the answer, clearly state so.
Structure your answer intuitively and use bullet points when listing facts or arguments."""

    openai_client = _get_client()
    response = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0.1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Document Context:\n{context_str}\n\n---\n\nUser Query: {query}"},
        ],
    )
    
    # Cleanup memory
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass

    return {
        "answer": response.choices[0].message.content,
        "sources": sources
    }
