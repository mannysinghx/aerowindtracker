import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import CrosswindCalculatorPage from './pages/CrosswindCalculatorPage';
import AviationWeatherMapPage from './pages/AviationWeatherMapPage';
import AiHazardPage from './pages/AiHazardPage';
import NotamDecoderPage from './pages/NotamDecoderPage';
import AboutPage from './pages/AboutPage';

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features/crosswind-calculator" element={<CrosswindCalculatorPage />} />
        <Route path="/features/live-aviation-weather-map" element={<AviationWeatherMapPage />} />
        <Route path="/features/ai-hazard-intelligence" element={<AiHazardPage />} />
        <Route path="/features/notam-decoder" element={<NotamDecoderPage />} />
        {/* Fallback: redirect unknown routes to app */}
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}
