'use client';

import { useOrganization } from '@/contexts/OrganizationContext';
import { ChevronDown, Building2, Check, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function OrganizationSelector() {
  const {
    organizations,
    currentOrganization,
    switchOrganization,
    switchingOrg,
    loading,
  } = useOrganization();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (loading || !currentOrganization) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading organizations...</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
        <Building2 className="w-4 h-4" />
        <span>No organizations</span>
      </div>
    );
  }

  const handleSelect = (orgId: string) => {
    if (orgId !== currentOrganization.id) {
      switchOrganization(orgId);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Organization Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switchingOrg}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
      >
        {switchingOrg ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Building2 className="w-4 h-4" />
        )}
        <span className="flex-1 text-left truncate">
          {currentOrganization.name}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[250px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700">
              Your Organizations
            </div>

            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => handleSelect(org.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                  {org.name.substring(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium truncate">{org.name}</div>
                  <div className="text-xs text-gray-400 capitalize">
                    {org.your_role}
                  </div>
                </div>

                {currentOrganization.id === org.id && (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}

                {org.is_default && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-full flex-shrink-0">
                    Default
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Organization count */}
          <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-700 bg-gray-900">
            {organizations.length} organization
            {organizations.length !== 1 ? 's' : ''} available
          </div>
        </div>
      )}

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
