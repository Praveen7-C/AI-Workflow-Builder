from typing import Dict, Any, Optional
import httpx
import json
from fastapi import HTTPException


async def perform_web_search(
    query: str,
    serp_api_key: str,
    num_results: int = 5
) -> Dict[str, Any]:
    """
    Performs a web search using SerpAPI and returns search results.
    
    Args:
        query (str): The search query
        serp_api_key (str): SerpAPI key for authentication
        num_results (int): Number of results to return
        
    Returns:
        Dict containing search results and metadata
    """
    if not serp_api_key:
        raise ValueError("WebSearchNode requires serp_api_key.")
    
    url = "https://serpapi.com/search"
    params = {
        "api_key": serp_api_key,
        "q": query,
        "num": num_results,
        "engine": "google",
        "output": "json",
    }
    
    print(f"WebSearchNode: Searching for '{query}'")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            search_results = response.json()
        
        results = []
        if "organic_results" in search_results:
            for result in search_results["organic_results"][:num_results]:
                results.append({
                    "title": result.get("title", ""),
                    "link": result.get("link", ""),
                    "snippet": result.get("snippet", ""),
                })
        
        # Format results as a string for LLM consumption
        formatted_results = ""
        if results:
            for i, r in enumerate(results, 1):
                formatted_results += f"{i}. {r['title']}\n"
                formatted_results += f"   {r['snippet']}\n"
                formatted_results += f"   URL: {r['link']}\n\n"
        
        print(f"WebSearchNode: Found {len(results)} results")
        
        return {
            "results": results,
            "formatted_results": formatted_results,
            "query": query,
        }
        
    except httpx.HTTPStatusError as e:
        print(f"WebSearchNode: HTTP error - {e}")
        raise HTTPException(status_code=500, detail=f"Web search failed: {str(e)}")
    except httpx.RequestError as e:
        print(f"WebSearchNode: Request error - {e}")
        raise HTTPException(status_code=500, detail=f"Web search failed: {str(e)}")
    except Exception as e:
        print(f"WebSearchNode: Unexpected error - {e}")
        raise HTTPException(status_code=500, detail=f"Web search failed: {str(e)}")


async def process_web_search(
    query: str,
    serp_api_key: str,
    num_results: int = 5
) -> Dict[str, Any]:
    """
    Main entry point for web search node processing.
    
    Args:
        query (str): The search query
        serp_api_key (str): SerpAPI key
        num_results (int): Number of results to return
        
    Returns:
        Dict containing search results
    """
    return await perform_web_search(
        query=query,
        serp_api_key=serp_api_key,
        num_results=num_results
    )
