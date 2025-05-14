'use client';

import { useState } from 'react';

import Home from './components/Home';
import Humanizer from './components/Humanizer';
import Sidebar from './components/Sidebar';
//
//

export default function AppPage() {
  const [activeSection, setActiveSection] = useState('humanizer');

  return (
    <div className='flex h-screen w-full overflow-hidden justify-between bg-gray-100 text-[#1e293b] '>
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      <div className='flex flex-col flex-1 overflow-auto'>
        <main className='flex-1 p-10 my-10 '>
          {activeSection === 'home' && <Home />}
          {activeSection === 'humanizer' && <Humanizer />}
        </main>
      </div>
    </div>
  );
}
