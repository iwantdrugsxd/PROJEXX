// src/components/layout/Layout.jsx
import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Assignment,
  Group,
  Person,
  Settings,
  Logout,
  Notifications,
  Search,
  Add,
  School,
  Engineering,
} from '@mui/icons-material';

import { logout } from '../../store/slices/authSlice';

const drawerWidth = 280;

const Layout = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(null);
  
  const { user, userType } = useSelector((state) => state.auth);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setProfileMenu(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenu(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const menuItems = userType === 'faculty' ? [
    { text: 'Dashboard', icon: <Dashboard />, path: '/faculty/dashboard' },
    { text: 'Projects', icon: <Assignment />, path: '/projects' },
    { text: 'Teams', icon: <Group />, path: '/teams' },
    { text: 'Students', icon: <School />, path: '/students' },
  ] : [
    { text: 'Dashboard', icon: <Dashboard />, path: '/student/dashboard' },
    { text: 'My Teams', icon: <Group />, path: '/teams' },
    { text: 'Projects', icon: <Assignment />, path: '/projects' },
    { text: 'Join Team', icon: <Add />, path: '/teams/join' },
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section */}
      <Box
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6B46C1 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(107, 70, 193, 0.3)',
            }}
          >
            <Engineering sx={{ color: 'white', fontSize: 20 }} />
          </Box>
        </motion.div>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
          ProjectSync
        </Typography>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, px: 2, py: 1 }}>
        {menuItems.map((item, index) => (
          <motion.div
            key={item.text}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <ListItem
              button
              onClick={() => navigate(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                my: 0.5,
                '&.Mui-selected': {
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                  borderLeft: `4px solid ${theme.palette.primary.main}`,
                },
                '&:hover': {
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                },
              }}
            >
              <ListItemIcon sx={{ color: theme.palette.primary.main }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontWeight: 500 }}
              />
            </ListItem>
          </motion.div>
        ))}
      </List>

      {/* User Profile Section */}
      <Box sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          }}
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #6B46C1 0%, #A855F7 100%)',
            }}
          >
            {user?.FirstName?.[0] || user?.name?.[0] || 'U'}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
              {user?.FirstName} {user?.LastName} {user?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {userType === 'faculty' ? 'Faculty' : 'Student'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {location.pathname.split('/').pop()?.charAt(0).toUpperCase() +
              location.pathname.split('/').pop()?.slice(1) || 'Dashboard'}
          </Typography>

          {/* Search */}
          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Search />
          </IconButton>

          {/* Notifications */}
          <IconButton color="inherit" sx={{ mr: 1 }}>
            <Badge badgeContent={3} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          {/* Profile Menu */}
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #6B46C1 0%, #A855F7 100%)',
              }}
            >
              {user?.FirstName?.[0] || user?.name?.[0] || 'U'}
            </Avatar>
          </IconButton>

          <Menu
            id="menu-appbar"
            anchorEl={profileMenu}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(profileMenu)}
            onClose={handleProfileMenuClose}
            PaperProps={{
              sx: {
                mt: 1.5,
                minWidth: 200,
                background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              },
            }}
          >
            <MenuItem onClick={() => navigate('/profile')}>
              <Person sx={{ mr: 2 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={() => navigate('/settings')}>
              <Settings sx={{ mr: 2 }} />
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 2 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Side Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              backdropFilter: 'blur(20px)',
              border: 'none',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              backdropFilter: 'blur(20px)',
              border: 'none',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
        }}
      >
        <Toolbar />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  );
};

export default Layout;