import json
import os
from typing import Dict, Any, Iterable, List


def save_json(path: str, items: Iterable[Dict[str, Any]]) -> int:
    """
    Save items as a JSON array to a file.
    Creates directory if it doesn't exist.
    
    Args:
        path: Output file path
        items: Iterable of job dictionaries
        
    Returns:
        Number of items saved
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    # Convert iterable to list
    items_list: List[Dict[str, Any]] = list(items)
    count = len(items_list)
    
    # Save as JSON array
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items_list, f, ensure_ascii=False, indent=2)
    
    return count
