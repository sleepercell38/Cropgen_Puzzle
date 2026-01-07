import { v4 as uuidv4 } from "uuid";

// Cookie options
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

// Session middleware - creates or reads session ID from cookie
export const sessionMiddleware = (req, res, next) => {
  
  // Check for existing session cookie
  let sessionId = req.cookies?.sessionId;

  // If no session, create new one
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie("sessionId", sessionId, COOKIE_OPTIONS);
  }

  // Attach to request
  req.sessionId = sessionId;
  
  next();
};