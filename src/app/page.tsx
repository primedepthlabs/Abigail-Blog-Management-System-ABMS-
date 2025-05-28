'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Home from './components/Home';
import Humanizer from './components/Humanizer'; // This is actually the BlogTable component
import Sidebar from './components/Sidebar';
import RssManager from './components/RssManager';
import { Sun, Moon } from 'lucide-react';
import AnyBlog from './components/anyblog';
import BlogHumanizerUI from './components/anyblog';

export default function AppPage() {
  const [activeSection, setActiveSection] = useState('humanizer');
  const [theme, setTheme] = useState('light');
  const [isMounted, setIsMounted] = useState(false);

  // Handle theme switching with system preference detection
  useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'system';

    if (savedTheme === 'system') {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';
      setTheme(systemPreference);
    } else {
      setTheme(savedTheme);
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme') === 'system') {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (isMounted) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    }
  }, [theme, isMounted]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Only render content after mounting to prevent hydration issues
  if (!isMounted) return null;

  return (
    <div
      className={`flex h-screen w-full overflow-hidden transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-gradient-to-tr from-gray-900 to-slate-800 text-gray-100'
          : 'bg-gradient-to-tr from-gray-100 to-slate-200 text-[#1e293b]'
      }`}
    >
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Main Content */}
      <div className='flex flex-col flex-1 overflow-auto'>
        {/* Header with theme toggle */}
        <header
          className={`sticky top-0 z-50 px-6 py-4 flex items-center justify-between transition-colors duration-300 ${
            theme === 'dark'
              ? ' border-b border-gray-700'
              : 'bg-white/80 border-b border-gray-200'
          } backdrop-blur-md`}
        >
          <h1
            className={`text-xl pl-10 font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-800'
            }`}
          >
            {activeSection === 'home'
              ? 'Dashboard'
              : activeSection === 'humanizer'
              ? 'Blogs'
              : activeSection === 'anyblog'
              ? 'Blog Humanizer'
              : activeSection === 'rss'
              ? 'RSS Feeds'
              : activeSection === 'notifications'
              ? 'Notifications'
              : 'Settings'}
          </h1>

          <div className='flex items-center pr-10 gap-4'>
            {/* Theme Toggle Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-colors duration-200 ${
                theme === 'dark'
                  ? 'bg-gray-800 text-blue-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
              }`}
              aria-label={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </motion.button>

            <div
              className={`h-8 w-8 rounded-full ${
                theme === 'dark'
                  ? 'bg-gradient-to-br from-purple-600 to-blue-500'
                  : 'bg-gradient-to-br from-purple-600 to-blue-500'
              } flex items-center justify-center text-white font-medium`}
            >
              U
            </div>
          </div>
        </header>

        <main className='flex-1 p-6 sm:p-10 transition-all'>
          {activeSection === 'humanizer' && (
            <Humanizer theme={theme} setTheme={setTheme} />
          )}

          {activeSection !== 'humanizer' && (
            <div
              className={`rounded-2xl backdrop-blur-sm shadow-xl p-6 sm:p-8 min-h-[80vh] transition-colors duration-300 ${
                theme === 'dark'
                  ? 'bg-gray-800/70 shadow-lg shadow-black/20'
                  : 'bg-white/70 shadow-xl shadow-gray-200/50'
              }`}
            >
              {activeSection === 'home' && (
                <Home theme={theme} setTheme={setTheme} />
              )}

              {activeSection === 'rss' && (
                <RssManager theme={theme} setTheme={setTheme} />
              )}
              {activeSection === 'anyblog' && (
                <BlogHumanizerUI theme={theme} setTheme={setTheme} />
              )}

              {activeSection === 'notifications' && (
                <div className='p-4'>
                  <h2 className='text-xl font-semibold mb-4'>Notifications</h2>
                  <div
                    className={`p-4 rounded-lg mb-3 ${
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <p className='font-medium'>System Update</p>
                    <p
                      className={`text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      New features available in the Humanizer tool.
                    </p>
                  </div>
                  <div
                    className={`p-4 rounded-lg mb-3 ${
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <p className='font-medium'>Welcome!</p>
                    <p
                      className={`text-sm ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      Thanks for trying AbiGail AI Assistant.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'settings' && (
                <div className='p-4'>
                  <h2 className='text-xl font-semibold mb-6'>Settings</h2>
                  <div
                    className={`p-6 rounded-lg ${
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <h3 className='text-lg font-medium mb-4'>Appearance</h3>
                    <div className='flex items-center justify-between mb-6'>
                      <span>Theme</span>
                      <div className='flex gap-2'>
                        <button
                          onClick={() => {
                            setTheme('light');
                            localStorage.setItem('theme', 'light');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm ${
                            theme === 'light'
                              ? 'bg-blue-500 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          Light
                        </button>
                        <button
                          onClick={() => {
                            setTheme('dark');
                            localStorage.setItem('theme', 'dark');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm ${
                            theme === 'dark'
                              ? 'bg-blue-500 text-white'
                              : theme === 'light'
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          Dark
                        </button>
                        <button
                          onClick={() => {
                            localStorage.setItem('theme', 'system');
                            const isDark = window.matchMedia(
                              '(prefers-color-scheme: dark)',
                            ).matches;
                            setTheme(isDark ? 'dark' : 'light');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm ${
                            localStorage.getItem('theme') === 'system'
                              ? 'bg-blue-500 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-600 text-gray-300'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          System
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
