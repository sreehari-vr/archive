// Middleware to generate breadcrumbs
function generateBreadcrumbs(req, res, next) {
    const path = req.path;
    
    // Skip generating breadcrumbs for home or root
    if (path === '/' || path === '/home') {
      res.locals.breadcrumbs = null;
      return next();
    }
  
    // Split path and build breadcrumbs array
    const pathSegments = path.split('/').filter(segment => segment);
    const breadcrumbs = [];
  
    let currentPath = '';
    breadcrumbs.push({ name: 'Home', url: '/home' }); // Add home as the first breadcrumb
    
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      breadcrumbs.push({
        name: segment.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase()), // Format name
        url: index === pathSegments.length - 1 ? null : currentPath, // No URL for the last item
      });
    });
  
    // Attach breadcrumbs to response locals
    res.locals.breadcrumbs = breadcrumbs;
    next();
  }
  
  module.exports = generateBreadcrumbs;
  