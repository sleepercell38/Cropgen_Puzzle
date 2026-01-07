// Calculate time remaining until 24 hours from creation
export const getTimeRemaining = (createdAt) => {
  const now = new Date();
  const created = new Date(createdAt);
  const expiresAt = new Date(created.getTime() + 24 * 60 * 60 * 1000);
  
  const diffMs = Math.max(0, expiresAt - now);
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return {
    hours,
    minutes,
    seconds,
    totalSeconds: Math.floor(diffMs / 1000),
    expiresAt: expiresAt.toISOString(),
    isExpired: diffMs <= 0
  };
};

// Check if session is within 24 hours
export const isWithin24Hours = (createdAt) => {
  const now = new Date();
  const created = new Date(createdAt);
  const diffHours = (now - created) / (1000 * 60 * 60);
  return diffHours < 24;
};