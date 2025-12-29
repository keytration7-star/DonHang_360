import { BrowserRouter, Routes, Route, HashRouter } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Warnings from './pages/Warnings';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  console.log('📱 App component đang render...');
  console.log('Current location:', window.location.href);
  console.log('Pathname:', window.location.pathname);
  console.log('Hash:', window.location.hash);

  // Sử dụng HashRouter cho Electron để tránh vấn đề với file:// protocol
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/warnings" element={<Warnings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

