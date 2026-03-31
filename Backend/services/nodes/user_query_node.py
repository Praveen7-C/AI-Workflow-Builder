from typing import Dict, Any

async def process_query(query: str) -> Dict[str, Any]:
    """
    Processes the user query as the workflow entry point.

    Args:
        query (str): The user's input query.

    Returns:
        Dict[str, Any]: A dictionary containing the processed query.
    """
    print(f"Processing query: '{query}'")
    return {"query": query}