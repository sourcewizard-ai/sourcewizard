# AuthKit (WorkOS) Usage Guide

AuthKit is a comprehensive authentication platform that scales from individual users to enterprise-level single sign-on solutions. This guide covers practical implementation patterns for different authentication scenarios.

--- USE CASE DELIMITER ---
# Use Case: Basic User Authentication with Hosted UI

## When to Use
- Starting a new application that needs user authentication
- Want to quickly implement secure login/signup without building custom forms
- Need a production-ready authentication flow with minimal development time
- Prefer a hosted solution that handles security best practices automatically

## Implementation

### Step 1: Install and Configure AuthKit
```bash
npm install @workos-inc/authkit-nextjs
# or
npm install @workos-inc/authkit-node
```

### Step 2: Set Up Environment Variables
```env
WORKOS_API_KEY=your_api_key
WORKOS_CLIENT_ID=your_client_id
WORKOS_REDIRECT_URI=http://localhost:3000/callback
```

### Step 3: Initialize AuthKit (Next.js Example)
```javascript
// lib/workos.js
import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);
```

### Step 4: Create Authentication Routes
```javascript
// pages/api/auth/login.js
import { workos } from '../../../lib/workos';

export default async function handler(req, res) {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId: process.env.WORKOS_CLIENT_ID,
    redirectUri: process.env.WORKOS_REDIRECT_URI,
  });

  res.redirect(authorizationUrl);
}

// pages/api/auth/callback.js
export default async function handler(req, res) {
  const { code } = req.query;

  try {
    const { user, accessToken } = await workos.userManagement.authenticateWithCode({
      code,
      clientId: process.env.WORKOS_CLIENT_ID,
    });

    // Store user session
    req.session.user = user;
    req.session.accessToken = accessToken;
    
    res.redirect('/dashboard');
  } catch (error) {
    res.redirect('/login?error=authentication_failed');
  }
}
```

### Step 5: Implement Login Component
```jsx
// components/LoginButton.jsx
export default function LoginButton() {
  return (
    <button 
      onClick={() => window.location.href = '/api/auth/login'}
      className="bg-blue-600 text-white px-4 py-2 rounded"
    >
      Sign In with AuthKit
    </button>
  );
}
```

## Best Practices
- Always use HTTPS in production for redirect URIs
- Implement proper session management and token storage
- Handle authentication errors gracefully with user-friendly messages
- Use environment-specific redirect URIs for development and production
- Implement logout functionality to clear sessions properly

--- USE CASE DELIMITER ---
# Use Case: Enterprise Single Sign-On (SSO) Integration

## When to Use
- Selling to enterprise customers who require SSO integration
- Need to support SAML, OIDC, or other enterprise identity providers
- Want to enable customers to use their existing identity systems
- Require seamless integration with Active Directory, Okta, Azure AD, etc.

## Implementation

### Step 1: Configure SSO Connection
```javascript
// lib/sso-setup.js
import { workos } from './workos';

export async function createSSOConnection(organizationId, ssoData) {
  const connection = await workos.sso.createConnection({
    source: ssoData.source, // 'saml' or 'oidc'
    organizationId,
    idpMetadata: ssoData.metadata, // For SAML
    // or
    oidcClientId: ssoData.clientId, // For OIDC
    oidcClientSecret: ssoData.clientSecret,
    oidcIssuer: ssoData.issuer,
  });

  return connection;
}
```

### Step 2: Implement Domain-Based SSO Detection
```javascript
// utils/sso-detection.js
export async function detectSSOForEmail(email) {
  const domain = email.split('@')[1];
  
  try {
    const organizations = await workos.organizations.listOrganizations({
      domains: [domain]
    });

    if (organizations.data.length > 0) {
      const org = organizations.data[0];
      const connections = await workos.sso.listConnections({
        organizationId: org.id
      });

      return connections.data.length > 0 ? org : null;
    }
  } catch (error) {
    console.error('SSO detection failed:', error);
  }

  return null;
}
```

### Step 3: Create SSO Authentication Flow
```javascript
// pages/api/auth/sso.js
export default async function handler(req, res) {
  const { email, organizationId } = req.body;

  try {
    const authorizationUrl = workos.sso.getAuthorizationUrl({
      organizationId,
      clientId: process.env.WORKOS_CLIENT_ID,
      redirectUri: process.env.WORKOS_REDIRECT_URI,
      state: JSON.stringify({ email }),
    });

    res.json({ authorizationUrl });
  } catch (error) {
    res.status(400).json({ error: 'SSO configuration not found' });
  }
}
```

### Step 4: Handle SSO Callback
```javascript
// pages/api/auth/sso-callback.js
export default async function handler(req, res) {
  const { code, state } = req.query;

  try {
    const profile = await workos.sso.getProfile({
      code,
      clientId: process.env.WORKOS_CLIENT_ID,
    });

    // Create or update user with SSO profile
    const user = await createOrUpdateUser({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      organizationId: profile.organizationId,
      ssoProfile: profile,
    });

    req.session.user = user;
    res.redirect('/dashboard');
  } catch (error) {
    res.redirect('/login?error=sso_failed');
  }
}
```

### Step 5: Implement Smart Login Component
```jsx
// components/SmartLogin.jsx
import { useState } from 'react';

export default function SmartLogin() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check for SSO
      const response = await fetch('/api/auth/detect-sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.requiresSSO) {
        // Redirect to SSO
        window.location.href = data.authorizationUrl;
      } else {
        // Use regular AuthKit flow
        window.location.href = '/api/auth/login';
      }
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Checking...' : 'Continue'}
      </button>
    </form>
  );
}
```

## Best Practices
- Implement domain-based SSO detection for seamless user experience
- Provide clear fallback options when SSO is not available
- Store SSO connection metadata securely
- Test SSO flows with actual enterprise identity providers
- Implement proper error handling for SSO failures
- Provide admin interfaces for SSO configuration management

--- USE CASE DELIMITER ---
# Use Case: Role-Based Access Control (RBAC) Implementation

## When to Use
- Need granular permission control within your application
- Building multi-tenant applications with different user roles
- Require enterprise-grade authorization beyond simple authentication
- Want to implement custom roles and permissions for different organizations

## Implementation

### Step 1: Define Roles and Permissions
```javascript
// lib/rbac-config.js
export const PERMISSIONS = {
  // User management
  'users:read': 'View users',
  'users:write': 'Create and edit users',
  'users:delete': 'Delete users',
  
  // Organization management
  'org:read': 'View organization details',
  'org:write': 'Edit organization settings',
  'org:admin': 'Full organization administration',
  
  // Billing
  'billing:read': 'View billing information',
  'billing:write': 'Manage billing and subscriptions',
};

export const DEFAULT_ROLES = {
  admin: {
    name: 'Administrator',
    permissions: Object.keys(PERMISSIONS),
  },
  manager: {
    name: 'Manager',
    permissions: ['users:read', 'users:write', 'org:read', 'billing:read'],
  },
  member: {
    name: 'Member',
    permissions: ['users:read', 'org:read'],
  },
};
```

### Step 2: Create Role Management Functions
```javascript
// lib/role-management.js
import { workos } from './workos';

export async function assignRoleToUser(userId, organizationId, roleSlug) {
  try {
    const organizationMembership = await workos.userManagement.createOrganizationMembership({
      userId,
      organizationId,
      roleSlug,
    });

    return organizationMembership;
  } catch (error) {
    throw new Error(`Failed to assign role: ${error.message}`);
  }
}

export async function updateUserRole(membershipId, roleSlug) {
  try {
    const membership = await workos.userManagement.updateOrganizationMembership({
      organizationMembershipId: membershipId,
      roleSlug,
    });

    return membership;
  } catch (error) {
    throw new Error(`Failed to update role: ${error.message}`);
  }
}

export async function getUserPermissions(userId, organizationId) {
  try {
    const memberships = await workos.userManagement.listOrganizationMemberships({
      userId,
      organizationId,
    });

    const permissions = new Set();
    
    for (const membership of memberships.data) {
      const role = await workos.userManagement.getRole(membership.roleSlug);
      role.permissions.forEach(permission => permissions.add(permission));
    }

    return Array.from(permissions);
  } catch (error) {
    throw new Error(`Failed to get permissions: ${error.message}`);
  }
}
```

### Step 3: Implement Permission Checking Middleware
```javascript
// middleware/auth-middleware.js
export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const { user } = req.session;
      const { organizationId } = req.params;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const permissions = await getUserPermissions(user.id, organizationId);
      
      if (!permissions.includes(permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission,
          userPermissions: permissions
        });
      }

      req.userPermissions = permissions;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
```

### Step 4: Create Permission-Based API Routes
```javascript
// pages/api/organizations/[orgId]/users.js
import { requirePermission } from '../../../middleware/auth-middleware';

export default async function handler(req, res) {
  const { method } = req;
  const { orgId } = req.query;

  switch (method) {
    case 'GET':
      return requirePermission('users:read')(req, res, async () => {
        const users = await getOrganizationUsers(orgId);
        res.json(users);
      });

    case 'POST':
      return requirePermission('users:write')(req, res, async () => {
        const newUser = await createOrganizationUser(orgId, req.body);
        res.json(newUser);
      });

    case 'DELETE':
      return requirePermission('users:delete')(req, res, async () => {
        await deleteOrganizationUser(orgId, req.body.userId);
        res.json({ success: true });
      });

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
```

### Step 5: Implement Frontend Permission Checks
```jsx
// hooks/usePermissions.js
import { useUser } from './useUser';
import { useState, useEffect } from 'react';

export function usePermissions(organizationId) {
  const { user } = useUser();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && organizationId) {
      fetchPermissions();
    }
  }, [user, organizationId]);

  const fetchPermissions = async () => {
    try {
      const response = await fetch(`/api/users/${user.id}/permissions?orgId=${organizationId}`);
      const data = await response.json();
      setPermissions(data.permissions);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission) => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList) => {
    return permissionList.some(permission => permissions.includes(permission));
  };

  return { permissions, hasPermission, hasAnyPermission, loading };
}

// components/PermissionGate.jsx
export function PermissionGate({ permission, children, fallback = null }) {
  const { hasPermission, loading } = usePermissions();

  if (loading) return <div>Loading...</div>;
  if (!hasPermission(permission)) return fallback;

  return children;
}
```

### Step 6: Role Management Interface
```jsx
// components/RoleManager.jsx
import { useState, useEffect } from 'react';
import { PermissionGate } from './PermissionGate';

export default function RoleManager({ organizationId }) {
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);

  const updateMemberRole = async (membershipId, newRoleSlug) => {
    try {
      await fetch(`/api/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleSlug: newRoleSlug }),
      });
      
      // Refresh members list
      fetchMembers();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  return (
    <PermissionGate permission="users:write">
      <div className="role-manager">
        <h2>Organization Members</h2>
        {members.map(member => (
          <div key={member.id} className="member-row">
            <span>{member.user.email}</span>
            <select
              value={member.roleSlug}
              onChange={(e) => updateMemberRole(member.id, e.target.value)}
            >
              {roles.map(role => (
                