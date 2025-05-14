'use client';

import HomeIcon from '@mui/icons-material/Home';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export default function Sidebar({
  activeSection,
  setActiveSection,
}: SidebarProps) {
  return (
    <aside className='w-64 bg-white text-white p-6 space-y-6 shadow-md rounded rounded-tl-3xl rounded-tr-3xl  ml-2 mt-2'>
      <h2 className='text-3xl text-center font-semibold text-black'>AbiGail</h2>
      <ul className='space-y-3 py-6'>
        <li
          className={`cursor-pointer p-2 text-sm rounded-xl transition ${
            activeSection === 'home'
              ? 'bg-gray-200 text-gray-700 font-normal'
              : 'hover:bg-gray-200 text-gray-500 font-light'
          }`}
          onClick={() => setActiveSection('home')}
        >
          <div className='flex items-center gap-3'>
            <HomeIcon />
            Home
          </div>
        </li>

        <li
          className={`cursor-pointer p-2 text-sm rounded-xl transition ${
            activeSection === 'humanizer'
              ? 'bg-gray-200 text-gray-700 font-normal'
              : 'hover:bg-gray-200 text-gray-500 font-light'
          }`}
          onClick={() => setActiveSection('humanizer')}
        >
          <div className='flex items-center gap-3'>
            <SmartToyOutlinedIcon className='text-gray-500' />
            Humanizer
          </div>
        </li>
      </ul>
    </aside>
  );
}
