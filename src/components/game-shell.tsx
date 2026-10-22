export default function GameShell() {
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getSessionToken();
    if (token) {
      try {
        const [savedUser] = atob(token).split(":");
        if (savedUser) {
          setUser(savedUser);
          localStorage.setItem(NAME_STORAGE_KEY, savedUser);
        }
      } catch {}
    }
    setChecking(false);
  }, []);

  const handleLogout = () => {
    setSessionToken(null);
    setUser(null);
    localStorage.removeItem(NAME_STORAGE_KEY);
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <LoginGate onSuccess={setUser} />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">🍪 Кликер</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">👤 {user}</span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Выйти
            </Button>
          </div>
        </div>
        <WelcomeGate onFinish={() => {}} />
      </div>
    </main>
  );
}
