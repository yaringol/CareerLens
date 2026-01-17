# CareerLens Frontend

React + TypeScript frontend application for CareerLens CV match analysis.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── MatchOverviewDisplay.tsx    # Match overview component
│   │   └── MatchOverviewDisplay.css     # Component styles
│   ├── pages/
│   │   ├── InputPage.tsx                # CV upload & job description input
│   │   ├── InputPage.css
│   │   ├── ExtractPage.tsx              # Extraction progress display
│   │   ├── ExtractPage.css
│   │   ├── ResultsPage.tsx              # Results display page
│   │   └── ResultsPage.css
│   ├── App.tsx                          # Main app with routing
│   ├── App.css                          # App styles
│   ├── main.tsx                         # Entry point
│   └── index.css                        # Global styles
├── index.html                           # HTML template
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript config
└── vite.config.ts                       # Vite configuration
```

## Features

- **Multi-Page Flow**: Three-page workflow (Input → Extract → Results)
- **Input Page**: CV PDF upload and job description input form
- **Extract Page**: Real-time progress display during CV analysis
- **Results Page**: Match score, skills analysis, and optimization suggestions
- **React Router**: Navigation between pages
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, professional interface with smooth animations

## Development

The frontend uses:
- **React 18** with TypeScript
- **Vite** for fast development and building
- **CSS Modules** for component styling

## Pages

1. **Input Page** (`/input`): Upload CV and enter job description
2. **Extract Page** (`/extract`): Shows extraction progress (auto-navigates from input)
3. **Results Page** (`/results`): Displays match analysis results

## Next Steps

- Connect to backend API for real data extraction
- Implement actual file upload to backend
- Add real-time extraction status updates
- Integrate with NLP pipeline for skill extraction
