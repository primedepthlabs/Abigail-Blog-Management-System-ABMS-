// Updated SidebarProps interface to include theme props
import { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import { useState } from 'react';

// Updated interface to include theme props
interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  theme: string;
  setTheme: Dispatch<SetStateAction<string>>;
}

export default function Sidebar({
  activeSection,
  setActiveSection,
  theme,
  setTheme,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [notificationCount, setNotificationCount] = useState(3);

  // Menu items definition
  const menuItems = [
    {
      id: 'humanizer',
      label: 'Humanizer',
      icon: <SmartToyRoundedIcon />,
      badge: 'New',
    },
    {
      id: 'rss',
      label: 'RSS Feeds',
      icon: <RssFeedIcon />,
      badge: null,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsOutlinedIcon />,
      badge: null,
    },
  ];

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`${
        isExpanded ? 'w-72' : 'w-20'
      } transition-all duration-300 ease-in-out
        ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-gray-900 to-gray-800 border-gray-700'
            : 'bg-white border-gray-100'
        }
        relative flex flex-col h-full rounded-3xl border shadow-lg ml-2 mt-2 overflow-hidden`}
    >
      {/* Toggle expand button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`absolute -right-3 top-20 h-6 w-6 rounded-full flex items-center justify-center z-10
          ${
            theme === 'dark'
              ? 'bg-gray-700 text-gray-300'
              : 'bg-white text-gray-600'
          } 
          shadow-md border ${
            theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
          }`}
      >
        <KeyboardArrowRightIcon
          className={`text-sm transition-transform ${
            !isExpanded ? '' : 'rotate-180'
          }`}
          style={{ fontSize: '14px' }}
        />
      </motion.button>

      {/* Logo & Brand */}
      <div
        className={`pt-8 pb-6 ${
          isExpanded ? 'px-6' : 'px-2'
        } text-center relative`}
      >
        <div className='absolute inset-0 overflow-hidden'>
          <div
            className={`${
              theme === 'dark' ? 'opacity-10' : 'opacity-5'
            } w-40 h-40 rounded-full bg-gradient-to-r 
            from-purple-600 to-blue-500 absolute -top-20 -right-20`}
          ></div>
        </div>

        <div className='relative'>
          <motion.div
            layout
            className='flex items-center justify-center gap-3 mb-1'
          >
            <div className='flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 text-white font-bold'>
              A
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.h2
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`text-2xl font-bold ${
                    theme === 'dark'
                      ? 'text-white'
                      : 'bg-gradient-to-r from-purple-600 to-blue-500 text-transparent bg-clip-text'
                  }`}
                >
                  AbiGail
                </motion.h2>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-400'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  AI ASSISTANT
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Menu */}
      <nav className='flex-grow px-4'>
        <ul className='space-y-2'>
          {menuItems.map((item) => (
            <li key={item.id}>
              <motion.button
                whileHover={{ scale: isExpanded ? 1.02 : 1.1 }}
                whileTap={{ scale: 0.98 }}
                layout
                onClick={() => setActiveSection(item.id)}
                className={`group w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-200 
                  ${
                    activeSection === item.id
                      ? theme === 'dark'
                        ? 'bg-gray-800 text-blue-400'
                        : 'bg-blue-50 text-blue-600 font-medium'
                      : theme === 'dark'
                      ? 'hover:bg-gray-800/50 text-gray-400'
                      : 'hover:bg-gray-50 text-gray-500'
                  }
                  ${!isExpanded && 'justify-center'}`}
              >
                {/* Icon with animated background for active state */}
                <div className='relative'>
                  <motion.div
                    animate={{
                      scale: activeSection === item.id ? 1 : 0,
                      opacity: activeSection === item.id ? 0.2 : 0,
                    }}
                    className={`absolute inset-0 -m-1 rounded-full ${
                      theme === 'dark' ? 'bg-blue-500' : 'bg-blue-500'
                    }`}
                    style={{ width: '30px', height: '30px' }}
                  />
                  <div
                    className={`relative z-10 ${
                      activeSection === item.id
                        ? theme === 'dark'
                          ? 'text-blue-400'
                          : 'text-blue-600'
                        : theme === 'dark'
                        ? 'text-gray-400'
                        : 'text-gray-500'
                    } 
                    group-hover:${
                      theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                    } transition-colors`}
                  >
                    {item.icon}
                  </div>
                </div>

                {/* Label with animated entrance/exit */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      transition={{ duration: 0.2 }}
                      className='flex-grow flex items-center justify-between'
                    >
                      <span>{item.label}</span>

                      {/* Badge for notifications or labels */}
                      {item.badge && (
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className={`${
                            typeof item.badge === 'number'
                              ? theme === 'dark'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-blue-100 text-blue-600'
                              : theme === 'dark'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-purple-100 text-purple-600'
                          } text-xs px-2 py-0.5 rounded-full font-medium min-w-[20px] text-center`}
                        >
                          {item.badge}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Active indicator */}
                {activeSection === item.id && isExpanded && (
                  <motion.div
                    layoutId='activeIndicator'
                    className={`ml-auto w-1 h-8 ${
                      theme === 'dark' ? 'bg-blue-400' : 'bg-blue-500'
                    } rounded-full`}
                  />
                )}
              </motion.button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={`mt-auto p-4 ${isExpanded ? 'border-t' : ''} ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
        }`}
      >
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          layout
          className={`flex items-center ${
            isExpanded ? 'gap-3 px-4 py-3' : 'justify-center py-3'
          } rounded-xl 
            ${
              theme === 'dark'
                ? 'bg-gray-800 hover:bg-gray-700'
                : 'bg-gray-50 hover:bg-gray-100'
            } 
            cursor-pointer transition-colors duration-200`}
        >
          <div className='relative'>
            <div className='h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-white'>
              <AccountCircleRoundedIcon />
            </div>
            <div className='absolute -right-1 -bottom-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white'></div>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.2 }}
                className='flex-grow'
              >
                <p
                  className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                  }`}
                >
                  User Profile
                </p>
                <p
                  className={`text-xs ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Pro Account
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.aside>
  );
}
