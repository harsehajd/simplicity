# builtin
from contextlib import asynccontextmanager 

# external
from fastapi import FastAPI, Request
from pydantic import BaseModel # why pydantic? faster with fastapi & handles envionment config
from pydantic_settings import BaseSettings, SettingsConfigDict #takes settings from .env file
from openai import OpenAI
from fastapi.middleware.cors import CORSMiddleware
from serpapi.google_search import GoogleSearch 
from bs4 import BeautifulSoup #helpful for parsing the sources
import requests
from urllib.parse import urlparse

# internal

class Environment(BaseSettings): #pydantic class for environment variables
    model_config: SettingsConfigDict = SettingsConfigDict(env_file=".env") #loads the variables from the .env file
    OPENAI_API_KEY: str
    SERPAPI_KEY: str

class ChatInput(BaseModel): #pydantic class for the chat input
    input_message: str 

class Response(BaseModel): #pydantic class for the chat response
    # structured outputs 
    summary: str
    full_explanation: str
    relevant_sources: list[str]
    search_keywords: list[str]


@asynccontextmanager
async def lifespan(app: FastAPI): #taking in app, which is the fastapi instance
    # setup
    print("Starting up")
    environment: Environment = Environment() #instantiating the environment class
    app.state.environment = environment
    openai_client: OpenAI = OpenAI(api_key = environment.OPENAI_API_KEY) #instantiating the openai client
    app.state.openai_client = openai_client
    
    yield
    # teardown
    print("Shutting down")

app = FastAPI(lifespan=lifespan) 
app.add_middleware( #allows connections to frontend
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

@app.get("/")
#POST: send data to the server (create/take in data)
#GET: retrieve data from a server (read data)
#PUT: to update data.
#DELETE: to delete data.
async def root():
    return {"message": "what's up!"} #json outputs for servers

@app.post("/chat")
async def chat(input: ChatInput, request: Request):
    environment: Environment = app.state.environment
    openai_client: OpenAI = app.state.openai_client
    model: str = "gpt-4o-mini" 

    messages: list[dict[str, str]] = [
        {"role": "system", "content": "you're a helpful assistant that responds to the user's message in a friendly way. you are also a great tutor and explain concepts in a way that is easy to understand. you answer all queries using knowledge from the internet.",},
        {"role": "user", "content": input.input_message}]
    response_format = Response
    response = openai_client.beta.chat.completions.parse(response_format = response_format, model= model, messages = messages)
    result: Response = response.choices[0].message.parsed
    search_keywords = result.search_keywords

    # perform google search using search_keywords
    search_params = {
        "q": " ".join(search_keywords),  # join keywords into a single search query
        "api_key": environment.SERPAPI_KEY,
        "engine": "google"
    }
    search: GoogleSearch = GoogleSearch(search_params)
    search_results: dict[str, list[dict[str, str]]] = search.get_dict()

    # extract relevant information from search results
    organic_results: list[dict[str, str]] = search_results.get("organic_results", [])
    relevant_sources: list[str] = [result.get("link") for result in organic_results[:5]]  # get first 5 results

    # extract key information from each relevant source
    relevant_information: list[str] = []
    for url in relevant_sources: #iterating through the list of urls in relevant_sources
        try: #when prone to errors
            response: requests.Response = requests.get(url, timeout=5) #sending a get request to the url
            response.raise_for_status() #raising an exception for bad status codes
            soup: BeautifulSoup = BeautifulSoup(response.text, 'html.parser') #parsing the html content
            # extracting text content from the page
            text_content: str = ' '.join(p.get_text() for p in soup.find_all('p')) #joining the text content of the page
            relevant_information.append(text_content) #appending the text content to relevant_information
        except Exception as e:
            relevant_information.append(f"Error fetching content from {url}: {str(e)}") #appending the error message to relevant_information

    # using gpt to summarize the relevant information to give a summary and full explanation
    summary_input: str = " ".join(relevant_information) #turning the list of strings into a single string
    messages.append({"role": "system", "content": "Summarize the following information: " + summary_input}) #making the relevant information the input for the summary
    messages.append({"role": "system", "content": "Give a detailed explanation of the following information: " + summary_input}) #making the relevant information the input for the full explanation
    summary_response = openai_client.beta.chat.completions.parse(response_format=response_format, model=model, messages=messages)
    full_explanation_response = openai_client.beta.chat.completions.parse(response_format=response_format, model=model, messages=messages)
    summary_result: Response = summary_response.choices[0].message.parsed
    full_explanation_result: Response = full_explanation_response.choices[0].message.parsed

    # updating the response with the final summary and full explanation
    result.summary = summary_result.summary
    result.full_explanation = full_explanation_result.full_explanation
    result.relevant_sources = relevant_sources

    return {"my_response": result}


@app.get("/preview")
async def get_preview(url: str):
    try:
        # sending a get request to the url
        response: requests.Response = requests.get(url, timeout=5)
        response.raise_for_status()  
        
        # parsing the html content
        soup: BeautifulSoup = BeautifulSoup(response.text, 'html.parser')
        
        # storing the title of the page
        title: str = soup.title.string if soup.title else "No title found"
        
        # storing the hostname of the url
        url_host: str = urlparse(url).netloc
        
        return {
            "title": title,
            "url_host": url_host,
        }
    except Exception as e: #in case of an error
        return {
            "title": "Error fetching preview",
            "url_host": "Error",
            "error": str(e)
        }

# next steps: 
# streaming the response from openai
# displaying recommended follow-up questions
# making the full_explanation output more readable
# making it faster (?)