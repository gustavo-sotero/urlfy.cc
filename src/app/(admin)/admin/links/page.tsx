// src/app/(admin)/admin/links/page.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function AdminLinksPage() {
  const [query, setQuery] = useState('');
  const [results, _setResults] = useState([]);

  const handleSearch = async () => {
    // TODO: Implement search via API
    console.log('Searching for:', query);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gerenciar Links</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por código, URL ou usuário..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </div>

          {results.length === 0 ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Digite algo para buscar
            </div>
          ) : (
            <div className="mt-4">
              {/* TODO: Add results table with ban/unban actions */}
              <p className="text-sm text-muted-foreground">
                {results.length} resultado(s) encontrado(s)
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
