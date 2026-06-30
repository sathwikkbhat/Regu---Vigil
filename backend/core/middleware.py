from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Any

from .auth import verify_token

class JWTMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Allow open paths
        open_paths = ["/docs", "/openapi.json", "/auth/login", "/health"]
        if request.url.path in open_paths or request.method == "OPTIONS":
            return await call_next(request)
            
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            # We don't raise HTTPException here because FastAPI middleware
            # doesn't handle them fully, instead we let the endpoint dependencies handle it 
            # or return a JSONResponse
            # To stick to FastAPI best practices, middleware checks token format
            # and attaches user info to request.state.
            
            # Simple handling for now:
            request.state.user = None
            return await call_next(request)
            
        token = auth_header.split(" ")[1]
        try:
            payload = await verify_token(token)
            request.state.user = payload
        except Exception:
            request.state.user = None
            
        return await call_next(request)

class SiteScopeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        
        user: Dict[str, Any] = getattr(request.state, "user", None)
        
        # We only really care about site scope for /patients for the DOCTOR role
        # This will be enforced more strictly at the router level, but we can set state variables.
        if user and user.get("role") == "DOCTOR":
            request.state.site_id = user.get("site_id")
        else:
            request.state.site_id = None
            
        response = await call_next(request)
        return response

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Pre-process: we could log the request
        
        response = await call_next(request)
        
        # Post-process: log modifying actions
        user = getattr(request.state, "user", None)
        user_id = user.get("sub") if user else "anonymous"
        
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            # Here we would normally insert into `audit_logs`
            # For phase 2 foundation, we just print or do an async task
            print(f"AUDIT LOG: {request.method} {request.url.path} by {user_id}")
            
        return response
