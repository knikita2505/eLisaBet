import { loginAction } from "@/app/_actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-2xl font-bold tracking-tight">Вход</h1>
      <p className="mt-2 text-white/70">
        Введите уникальный код команды, чтобы делать ставки на ЧМ 2026.
      </p>

      <form
        action={loginAction}
        className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <label className="text-sm text-white/80">
          Код команды
          <input
            name="code"
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0f2744] px-3 py-2 outline-none focus:border-orange-500"
            placeholder="Например: ELISA-123"
            autoComplete="off"
            required
          />
        </label>

        {hasError ? (
          <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-2 text-sm text-red-100">
            Неверный код или команда не найдена.
          </div>
        ) : null}

        <button
          type="submit"
          className="mt-1 inline-flex justify-center rounded-lg bg-orange-500 px-4 py-2 font-semibold text-[#0f2744] hover:bg-orange-400"
        >
          Войти
        </button>
      </form>
    </div>
  );
}

