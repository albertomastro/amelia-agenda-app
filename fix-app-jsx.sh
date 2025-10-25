#!/bin/bash
# Script per modificare App.jsx con le correzioni API

# Backup del file originale
cp src/App.jsx src/App.jsx.backup

echo "🔧 Applicando modifiche API al file App.jsx..."

# 1. Modifica la funzione fetchAPI per gestire il nuovo formato
sed -i 's|const response = await fetch(`${apiUrl}${endpoint}`|// Converti endpoint al formato query string\
      let url;\
      if (endpoint.includes("?")) {\
        // Se ha già parametri (es: appointments?start_date=...)\
        const [action, params] = endpoint.split("?");\
        url = `${apiUrl}?action=${action}&${params}`;\
      } else if (endpoint.includes("/") \&\& !endpoint.startsWith("/")) {\
        // Se contiene uno slash (es: appointments/123)\
        const [action, id] = endpoint.split("/");\
        url = `${apiUrl}?action=${action}&id=${id}`;\
      } else {\
        // Endpoint semplice (es: services)\
        const cleanEndpoint = endpoint.startsWith("/") ? endpoint.substring(1) : endpoint;\
        url = `${apiUrl}?action=${cleanEndpoint}`;\
      }\
      console.log("🔧 API Call:", url);\
      const response = await fetch(url|g' src/App.jsx

# 2. Aggiorna le chiamate fetchAPI - rimuovi i slash iniziali
sed -i "s|fetchAPI('/services')|fetchAPI('services')|g" src/App.jsx
sed -i "s|fetchAPI('/customers')|fetchAPI('customers')|g" src/App.jsx
sed -i "s|fetchAPI('/locations')|fetchAPI('locations')|g" src/App.jsx
sed -i "s|fetchAPI('/stats')|fetchAPI('stats')|g" src/App.jsx

# 3. Aggiorna le chiamate con parametri
sed -i "s|fetchAPI(\`/appointments?|fetchAPI(\`appointments?|g" src/App.jsx

# 4. Aggiorna le chiamate con ID
sed -i "s|fetchAPI(\`/appointments/\${|fetchAPI(\`appointments/\${|g" src/App.jsx

# 5. Aggiorna le chiamate fetch dirette per availability
sed -i "s|\${apiUrl}/availability/days?|\${apiUrl}?action=availability/days\&|g" src/App.jsx
sed -i "s|\${apiUrl}/availability/slots?|\${apiUrl}?action=availability/slots\&|g" src/App.jsx

# 6. Aggiorna le altre chiamate fetch dirette
sed -i "s|\${apiUrl}/appointments|\${apiUrl}?action=appointments|g" src/App.jsx
sed -i "s|\${apiUrl}/customers|\${apiUrl}?action=customers|g" src/App.jsx

echo "✅ Modifiche completate!"
echo "📄 Backup salvato in: src/App.jsx.backup"
echo ""
echo "🧪 Per testare:"
echo "  npm run build"
echo "  npm run preview"
echo ""
echo "📤 Per pubblicare:"
echo "  git add src/App.jsx"
echo "  git commit -m 'Update API calls for direct endpoint'"
echo "  git push"
