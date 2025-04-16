# Talk To Excel

An application that allows you to upload Excel files and query them using natural language. The app converts Excel data to a SQLite database and uses Google's Gemini AI to translate natural language questions into SQL queries.

## Features

- Upload Excel files (.xlsx, .xls)
- Automatic conversion to SQLite database
- Natural language queries powered by Gemini AI
- Real-time SQL query generation and execution
- Clean and intuitive user interface

## Setup

### Prerequisites

- Python 3.8 or higher
- Node.js 14 or higher
- npm or yarn

### Backend Setup

1. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Add your Gemini API key:
   Open `app.py` and replace the empty string with your Gemini API key:
   ```python
   GEMINI_API_KEY = "your-api-key-here"  # Replace with your Gemini API key
   ```

3. Start the backend server:
   ```
   uvicorn app:app --reload
   ```

   The server will run at http://localhost:8000

### Frontend Setup

1. Install React dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn install
   ```

2. Start the frontend development server:
   ```
   npm run dev
   ```
   or
   ```
   yarn dev
   ```

   The frontend will be available at http://localhost:5173

## Usage

1. Open the application in your web browser
2. Upload an Excel file using the file input field
3. Once the file is uploaded and converted, you'll see a success message
4. Enter a natural language query about your data (e.g., "Show me the top 5 customers by total purchase amount")
5. Click "Run Query" to execute
6. View the generated SQL and the query results
7. Use "Clear Query" to keep the same file but try a different query
8. Use "Reset All" to upload a different file

## Examples

- "Show me all rows where the value in column A is greater than 100"
- "Count the number of entries grouped by category"
- "Find the average value in the Price column"
- "Show the top 3 products by sales"

## Technical Details

- Backend: FastAPI + SQLite + Pandas
- AI: Google Gemini Pro
- Frontend: React
- Data Processing: Excel files are converted to SQLite tables
- Session Management: Each upload creates a unique session with its own database file 