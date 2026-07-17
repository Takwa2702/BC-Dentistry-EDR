import { createContext, useContext, useState } from 'react';
import { getStoredUserRole } from '../utils/auth.js';

const RoleContext = createContext();

export function RoleProvider({ children }) {
  const [userRole, setUserRole] = useState(() => getStoredUserRole());

  return (
    <RoleContext.Provider value={{ userRole, setUserRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
