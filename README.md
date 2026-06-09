# GreenGrid_Compas_API

## Projektüberblick
Dieses Repository enthält Backend, Frontend und Prototypen für Green Grid Compass.

## Schnellstart

### Backend
```powershell
cd EU-Stromdaten Tool/prototype
pip install -r requirements.txt
copy .env.example .env
uvicorn backend:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```powershell
cd EU-Stromdaten Tool/prototype/frontend
copy .env.example .env
npm install
npm run dev
```

## Deployment
Die Frontend-Deployment-Konfiguration liegt in [EU-Stromdaten Tool/prototype/frontend/deploy.config.json](EU-Stromdaten Tool/prototype/frontend/deploy.config.json).

Für einen Provider wie Vercel, Netlify oder GitHub Pages kann der Build-Schritt direkt über die eingestellten Variablen laufen:
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable: `VITE_BACKEND_URL`
