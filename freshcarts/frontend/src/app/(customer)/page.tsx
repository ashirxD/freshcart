'use client';

import { useRouter } from 'next/navigation';
import { PackageOpen } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { SearchBar } from '@/components/common/search-bar';
import { SectionHeader } from '@/components/common/section-header';
import { Container } from '@/components/layout/container';
import { useAuthStore } from '@/store/auth.store';

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  const greeting = user ? 'Assalam-o-Alaikum, ' + user.fullName.split(' ')[0] : 'Assalam-o-Alaikum';

  return (
    <div id="main-content" className="flex flex-col gap-lg py-gutter">
      <Container className="flex flex-col gap-gutter">
        <header className="flex flex-col gap-1">
          {/* Reserve the line height while the session resolves, so nothing jumps. */}
          <h1 className="text-2xl font-bold text-primary">
            {status === 'loading' ? ' ' : greeting}
          </h1>
          <p className="text-base text-text-muted">What do you need today?</p>
        </header>

        <SearchBar onSubmit={(term) => router.push('/search?q=' + encodeURIComponent(term))} />
      </Container>

      <Container className="flex flex-col gap-gutter">
        <SectionHeader
          title="Shop by category"
          subtitle="Fresh produce, pantry staples and daily essentials"
        />

        {/*
          Categories are served by the API and rendered from that response — they
          are never hardcoded here. Until the categories module ships, this states
          the situation plainly rather than showing invented products.
        */}
        <EmptyState
          icon={<PackageOpen className="size-7" aria-hidden="true" />}
          title="The catalogue is on its way"
          description="Categories and products will appear here as soon as the catalogue module is connected."
          className="rounded-lg bg-surface-muted"
        />
      </Container>
    </div>
  );
}
