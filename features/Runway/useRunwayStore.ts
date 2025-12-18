
import { useState, useCallback } from 'react';
import { RunwayEngine } from './RunwayEngine';

export const useRunwayStore = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    const [selectedBase, setSelectedBase] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const models = await RunwayEngine.findBaseModels(searchQuery);
            setWhiteBases(models);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery]);

    const reset = useCallback(() => {
        setSearchQuery('');
        setWhiteBases([]);
        setSelectedBase(null);
        setIsSearching(false);
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        isSearching,
        whiteBases,
        selectedBase,
        setSelectedBase,
        handleSearch,
        reset
    };
};
