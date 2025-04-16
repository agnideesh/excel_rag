from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Float, text
import pandas as pd
import tempfile
import os
import json
import google.generativeai as genai
from typing import Optional
import sqlite3
import uuid

# Configure Gemini API
GEMINI_API_KEY = "AIzaSyDowIOAgzk-CMXEKXxQNsgGOuhJWNFiz7Q"  # Replace with your Gemini API key
genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

# Allow frontend from localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store temporary database connections
db_sessions = {}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Create a temporary file to store the Excel data
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(await file.read())
            temp_path = temp_file.name
        
        # Read Excel file
        df = pd.read_excel(temp_path)
        
        # Generate a unique session ID
        session_id = str(uuid.uuid4())
        
        # Create SQLite database in memory
        db_path = f"temp_db_{session_id}.db"
        conn = sqlite3.connect(db_path)
        
        # Convert Excel data to SQLite table
        table_name = os.path.splitext(file.filename)[0].replace(" ", "_")
        df.to_sql(table_name, conn, index=False, if_exists='replace')
        
        # Store session info
        db_sessions[session_id] = {
            "db_path": db_path,
            "table_name": table_name,
            "conn": conn,
            "schema": {
                "table_name": table_name,
                "columns": [{"name": col, "type": str(df[col].dtype)} for col in df.columns]
            }
        }
        
        # Clean up temp file
        os.unlink(temp_path)
        
        return {"session_id": session_id, "message": f"File {file.filename} uploaded successfully", "table_name": table_name}
    
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Upload failed: {str(e)}"})

@app.post("/query")
async def query_db(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "")
    session_id = body.get("session_id", "")
    
    if not prompt or not session_id:
        return {"error": "Prompt or session ID missing."}
    
    if session_id not in db_sessions:
        return {"error": "Invalid session. Please upload a file first."}
    
    try:
        session = db_sessions[session_id]
        table_name = session["table_name"]
        db_path = session["db_path"]
        schema = session["schema"]
        
        # Format the schema information for the model
        schema_description = f"Table: {table_name}\nColumns: "
        schema_description += ", ".join([f"{col['name']} ({col['type']})" for col in schema["columns"]])
        
        # Ask Gemini to generate SQL
        model = genai.GenerativeModel(model_name="gemini-1.5-flash")
        
        # Use different prompts based on query context
        if "summary" in prompt.lower() or "analyze" in prompt.lower() or "overview" in prompt.lower():
            system_prompt = f"""You are a data analysis expert working with SQLite.
Use the schema below to write a valid SQL query that will analyze or summarize the data.

{schema_description}

For summary queries, include COUNT(*), table structure, column names and data types.
If asked about statistics, include MIN, MAX, AVG calculations on numeric columns.
Return only the SQL query, nothing else.
"""
        else:
            system_prompt = f"""You are a SQLite expert.
Use the schema below to write a valid SQL query for the user's prompt.

{schema_description}

IMPORTANT: If the query involves ordering, sorting, or ranking based on a specific column, 
always include that column in the SELECT statement. For example, if asked for "top 3 products by sales",
make sure to include both product name AND sales columns in the results.

Return only the SQL query, nothing else.
"""
        
        chat = model.start_chat(history=[])
        response = chat.send_message(
            f"{system_prompt}\n\nUser query: {prompt}"
        )
        
        sql = response.text.strip()
        # Clean up SQL if it contains markdown formatting
        if sql.startswith("```sql"):
            sql = sql.strip("```sql").strip()
        if sql.startswith("```"):
            sql = sql.strip("```").strip()
        
        # Execute the SQL query
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(sql)
        
        if sql.lower().strip().startswith("select"):
            # Get column names from cursor description
            columns = [desc[0] for desc in cursor.description]
            
            # Fetch all rows
            rows = cursor.fetchall()
            
            # Convert rows to list of dicts
            data = []
            for row in rows:
                data.append(dict(zip(columns, row)))
                
            return {"sql": sql, "data": data}
        else:
            conn.commit()
            return {"sql": sql, "message": f"{cursor.rowcount} rows affected."}
        
    except Exception as e:
        return {"error": f"Server error: {str(e)}"}

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    if session_id in db_sessions:
        # Close the connection
        db_sessions[session_id]["conn"].close()
        
        # Delete the database file
        os.remove(db_sessions[session_id]["db_path"])
        
        # Remove from session store
        del db_sessions[session_id]
        
        return {"message": "Session deleted successfully"}
    
    return {"error": "Session not found"}

@app.on_event("shutdown")
async def cleanup():
    # Clean up all database connections on shutdown
    for session_id in list(db_sessions.keys()):
        db_sessions[session_id]["conn"].close()
        os.remove(db_sessions[session_id]["db_path"])
