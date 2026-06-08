import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-7xl font-bold text-white/10 mb-4">403</p>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Access Forbidden</h1>
        <p className="text-muted-foreground mb-6">
          You don&apos;t have permission to view this page.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </div>
  );
}
