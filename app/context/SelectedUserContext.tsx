import { createContext, ReactNode, useContext, useState } from "react";

interface SelectedUser {
  id: string;
  name: string;
  image: string;
}

interface SelectedUserContextType {
  user: SelectedUser | null;
  setUser: (u: SelectedUser | null) => void;
}

const SelectedUserContext = createContext<SelectedUserContextType>({
  user: null,
  setUser: () => {},
});

export const SelectedUserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SelectedUser | null>(null);

  return (
    <SelectedUserContext.Provider value={{ user, setUser }}>
      {children}
    </SelectedUserContext.Provider>
  );
};

export const useSelectedUser = () => useContext(SelectedUserContext);
