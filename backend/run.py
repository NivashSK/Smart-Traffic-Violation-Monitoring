import uvicorn
import os
import sys

if __name__ == "__main__":
    # Add parent directory to sys.path to resolve 'app' correctly
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    # Run development server
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
