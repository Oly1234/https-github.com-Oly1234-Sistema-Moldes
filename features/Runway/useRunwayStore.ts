
import { useState, useCallback } from 'react';
import { RunwayEngine } from './RunwayEngine';

export const useRunwayStore = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [whiteBases, setWhiteBases] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(10);
    const [selectedBase, setSelectedBase] = useState<string | null>(null);
    const [patternImage, setPatternImage] = useState<string | null>(null);

    const handleSearch = useCallback(async (imageForSearch?: string) => {
        setIsSearching(true);
        setVisibleCount(10);
        try {
            let models: string[] = [];
            if (imageForSearch) {
                models = await RunwayEngine.findBaseModelsByImage(imageForSearch);
            } else if (searchQuery.trim()) {
                models = await RunwayEngine.findBaseModels(searchQuery);
            }
            setWhiteBases(models);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery]);

    const loadMore = () => {
        setVisibleCount(prev => Math.min(prev + 10, whiteBases.length));
    };

    const reset = () => {
        setSearchQuery('');
        setWhiteBases([]);
        setSelectedBase(null);
        setPatternImage(null);
        setIsSearching(false);
        setVisibleCount(10);
    };

    return {
        searchQuery,
        setSearchQuery,
        isSearching,
        whiteBases,
        visibleCount,
        selectedBase,
        setSelectedBase,
        patternImage,
        setPatternImage,
        handleSearch,
        loadMore,
        reset
    };
};
