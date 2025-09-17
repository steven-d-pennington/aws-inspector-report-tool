# Tab Navigation Partial Usage Example

## Basic Usage

```ejs
<%- include('partials/tabs', {
    modules: enabledModules,
    activeModule: currentModuleId,
    context: { hasSettings: true }
}) %>
```

## Data Structure Examples

### Modules Array Example
```javascript
const modules = [
    {
        id: 'aws-inspector',
        name: 'AWS Inspector',
        icon: '🔍',
        enabled: true,
        displayOrder: 1,
        route: '/dashboard',
        status: 'active',
        badge: {
            count: 5,
            type: 'danger',
            text: '5 critical vulnerabilities'
        }
    },
    {
        id: 'sbom',
        name: 'SBOM Analysis',
        icon: '📦',
        enabled: true,
        displayOrder: 2,
        route: '/sbom',
        status: 'active',
        loadUrl: '/api/modules/sbom/content'
    },
    {
        id: 'container-scanning',
        name: 'Container Scanning',
        icon: '🐳',
        enabled: false,
        displayOrder: 3,
        status: 'coming-soon'
    }
];
```

### Usage in Controllers
```javascript
// In your route handler
app.get('/dashboard', async (req, res) => {
    const modules = await moduleService.getEnabledModules();
    const activeModule = 'aws-inspector';

    res.render('dashboard', {
        modules: modules,
        activeModule: activeModule,
        context: { hasSettings: true }
    });
});
```

## Features Included

### 1. Dynamic Tab Navigation
- Renders tabs based on enabled modules
- Sorts modules by display order
- Shows active tab based on activeModule parameter

### 2. Accessibility
- Full ARIA support with roles and labels
- Keyboard navigation (Arrow keys, Home, End, Enter, Space)
- Screen reader announcements
- Proper tabindex management

### 3. Responsive Design
- Uses existing CSS classes from style.css
- Mobile-friendly with scroll indicators
- Touch-friendly tap targets

### 4. Badge Support
- Optional badges for notifications/counts
- Different badge types (danger, warning, success, info)
- Accessible badge descriptions

### 5. Module States
- Active: Normal functioning module
- Disabled: Module not available
- Loading: Module content being loaded
- Error: Module failed to load
- Coming Soon: Module in development

### 6. Edge Case Handling
- No modules available: Shows helpful message
- Single module: Simplified interface
- JavaScript integration with existing TabManager

### 7. Data Attributes for JavaScript
- `data-module-id`: Module identifier
- `data-tab-trigger`: Tab trigger identifier
- `data-tab-content`: Content panel identifier
- `data-route`: Navigation route
- `data-load-url`: Dynamic content URL
- `data-status`: Module status

## CSS Classes Used

The partial uses CSS classes from the existing style.css:
- `.tab-container`
- `.tab-nav`
- `.tab-nav-item`
- `.tab-content`
- `.tab-pane`
- `.tab-badge`

## JavaScript Integration

The partial includes JavaScript that:
- Integrates with existing TabManager if available
- Provides keyboard navigation
- Handles dynamic content loading
- Manages accessibility states
- Triggers custom events for integration

## Global Functions

The partial exposes these global functions:
- `retryModule(moduleId)`: Retry loading a failed module
- `switchToModule(moduleId)`: Programmatically switch to a module
- `getActiveModule()`: Get the currently active module ID