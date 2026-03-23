/*
-- ===================================================
-- Código: /src/components/settings/ProfileSelector.tsx
-- Versão: 1.0
-- Data/Hora: 2025-05-23 18:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Componente de busca e seleção de perfis.
-- Fluxo: Usado em PeopleSettings.tsx para escolher o perfil a ser editado.
-- Dependências: react, lucide-react, clsx, ../ui/Avatar, ../../types/profile
-- ===================================================
*/
import { useState, useMemo, useEffect, useRef } from 'react';
import { Profile } from '../../types/profile';
import { Avatar } from '../ui/Avatar';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';

interface ProfileSelectorProps {
  profiles: Profile[];
  onSelect: (profile: Profile | null) => void;
  selectedProfile: Profile | null;
}

export const ProfileSelector = ({ profiles, onSelect, selectedProfile }: ProfileSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredProfiles = useMemo(() => {
    if (!searchTerm) return profiles;
    return profiles.filter(p =>
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [profiles, searchTerm]);

  const handleSelect = (profile: Profile) => {
    onSelect(profile);
    setSearchTerm(profile.full_name);
    setIsOpen(false);
  };
  
  const clearSelection = () => {
    onSelect(null);
    setSearchTerm('');
  };

  useEffect(() => {
    if (selectedProfile) {
      setSearchTerm(selectedProfile.full_name);
    } else {
      setSearchTerm('');
    }
  }, [selectedProfile]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if(selectedProfile && e.target.value !== selectedProfile.full_name) {
              onSelect(null);
            }
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-11 pr-10 py-2.5 rounded-lg bg-plate dark:bg-dark-s1 neumorphic-concave focus:bg-white dark:focus:bg-gray-700 transition-colors duration-200 outline-none"
        />
        {searchTerm && (
          <button onClick={clearSelection} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600"/>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute mt-2 w-full bg-plate dark:bg-dark-s1 rounded-lg neumorphic-convex p-2 z-10 max-h-60 overflow-y-auto">
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map(profile => (
              <div
                key={profile.id}
                onClick={() => handleSelect(profile)}
                className={clsx(
                  "flex items-center p-3 rounded-lg cursor-pointer hover:neumorphic-concave",
                  selectedProfile?.id === profile.id && "neumorphic-concave"
                )}
              >
                <Avatar src={profile.avatar_url} name={profile.full_name} className="w-10 h-10 mr-3" />
                <div>
                  <p className="font-semibold">{profile.full_name}</p>
                  <p className="text-sm text-gray-500 dark:text-dark-t2">{profile.email}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="p-3 text-center text-gray-500">Nenhum perfil encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
};
