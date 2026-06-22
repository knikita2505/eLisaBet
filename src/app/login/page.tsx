import { loginAction } from "@/app/_actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <div className="mx-auto mt-6 max-w-md">
      <div className="card-elevated">
        <h1 className="page-title">Вход</h1>
        <p className="page-desc">
          Введите уникальный код команды, чтобы делать ставки на ЧМ 2026.
        </p>

        <form action={loginAction} className="mt-6 flex flex-col gap-4">
          <label className="label">
            Код команды
            <input
              name="code"
              className="input"
              placeholder="Например: ELISA-123"
              autoComplete="off"
              required
            />
          </label>

          {hasError ? (
            <div className="alert-error">
              Неверный код или команда не найдена.
            </div>
          ) : null}

          <button type="submit" className="btn-primary w-full">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
