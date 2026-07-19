/* ============================================================
   useUniversitiesList — the seeded universities list for org screens.
   OrgOnboard + OrgEdit (both wrappers of OrgForm) need it to map a
   picked campus slug → university_id (FK) at submit; `loadFailed` is
   deliberately distinct from "loaded empty" so a fetch failure can't
   be mistaken for "no campus" (which would create or strip a campus
   silently). Screen-local data, not a NestedApp domain hook — mirrors
   userProfile.jsx's self-fetching precedent.
   ============================================================ */
import React from 'react'
import { orgService } from '../services/orgService'

const { useState, useEffect, useMemo } = React;

export function useUniversitiesList() {
  const [universities, setUniversities] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // No .catch: services resolve { data, error } and never throw.
    orgService.listUniversities().then(({ data, error }) => {
      if (cancelled) return;
      setUniversities(data || []);
      setLoadFailed(!!error);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const uniById = useMemo(() => {
    const map = {};
    universities.forEach((u) => { map[u.id] = u; });
    return map;
  }, [universities]);

  return { universities, uniById, loaded, loadFailed };
}
