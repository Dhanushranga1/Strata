from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from .auth import User, get_current_user

load_dotenv()

API_VERSION = os.getenv("API_VERSION", "0.1.0")
WEB_ORIGIN = os.getenv("WEB_ORIGIN", "http://localhost:3000")

app = FastAPI(title="TicketPilot API", version=API_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        WEB_ORIGIN, 
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://localhost:3002",  # Your Next.js dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001", 
        "http://127.0.0.1:3002"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and mount routers
from .kb import router as kb_router
from .tickets import router as tickets_router
from .rep import router as rep_router
from .admin import router as admin_router
from .feedback import router as feedback_router
app.include_router(kb_router)
app.include_router(tickets_router)
app.include_router(rep_router)
app.include_router(admin_router)
app.include_router(feedback_router)

@app.get("/api/health")
def health():
    return {"ok": True, "api": "ticketpilot", "version": API_VERSION}

@app.get("/api/me")
def me(user: User = Depends(get_current_user)):
    return user