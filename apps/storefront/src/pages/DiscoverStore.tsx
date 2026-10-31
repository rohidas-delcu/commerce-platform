import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

export function DiscoverStore() {
  const [handle, setHandle] = useState('');
  const navigate = useNavigate();
  return (
    <div className="discover">
      <div className="discover-card">
        <span className="wordmark">
          commerce<span>studio.</span>
        </span>
        <p className="eyebrow">INDEPENDENT STORES, BEAUTIFULLY CONNECTED</p>
        <h1>Discover your favorite store.</h1>
        <p>
          Each merchant has their own storefront. Enter the store handle shared by the merchant to
          begin.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (handle) void navigate({ to: `/s/${handle}` });
          }}
        >
          <label>
            Store handle
            <input
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. northline-goods"
              minLength={1}
            />
          </label>
          <button className="button primary">
            Continue <ArrowRight size={17} />
          </button>
        </form>
        <p className="smallprint">No store? Ask the merchant for their public storefront link.</p>
      </div>
    </div>
  );
}
