const timingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Interceptar el método end de la respuesta
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    // Log solo si la respuesta es lenta (>1 segundo)
    if (responseTime > 1000) {
      console.warn(`⚠️  Slow response: ${req.method} ${req.originalUrl} - ${responseTime}ms`);
    } else if (responseTime > 500) {
      console.log(`⏱️  Response: ${req.method} ${req.originalUrl} - ${responseTime}ms`);
    }
    
    // Agregar header de timing
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    // Llamar al método original
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = timingMiddleware;
