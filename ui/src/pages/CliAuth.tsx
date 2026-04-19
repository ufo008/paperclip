import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";

export function CliAuthPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const challengeId = (params.id ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim();
  const currentPath = useMemo(
    () => `/cli-auth/${encodeURIComponent(challengeId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    [challengeId, token],
  );

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const challengeQuery = useQuery({
    queryKey: ["cli-auth-challenge", challengeId, token],
    queryFn: () => accessApi.getCliAuthChallenge(challengeId, token),
    enabled: challengeId.length > 0 && token.length > 0,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: () => accessApi.approveCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await challengeQuery.refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => accessApi.cancelCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await challengeQuery.refetch();
    },
  });

  if (!challengeId || !token) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("errors.validationError")}</div>;
  }

  if (sessionQuery.isLoading || challengeQuery.isLoading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">{t("app.loading")}</div>;
  }

  if (challengeQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">{t("cliAuth.cliAuthChallengeUnavailable")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {challengeQuery.error instanceof Error ? challengeQuery.error.message : t("errors.validationError")}
          </p>
        </div>
      </div>
    );
  }

  const challenge = challengeQuery.data;
  if (!challenge) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">{t("cliAuth.cliAuthChallengeUnavailable")}</div>;
  }

  if (challenge.status === "approved") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">{t("cliAuth.cliAccessApproved")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("cliAuth.cliAccessApprovedMessage")}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("cliAuth.commandLabel")} <span className="font-mono text-foreground">{challenge.command}</span>
          </p>
        </div>
      </div>
    );
  }

  if (challenge.status === "cancelled" || challenge.status === "expired") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">
            {challenge.status === "expired" ? t("cliAuth.cliAuthExpired") : t("cliAuth.cliAuthCancelled")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("cliAuth.startCliAuthAgain")}
          </p>
        </div>
      </div>
    );
  }

  if (challenge.requiresSignIn || !sessionQuery.data) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">{t("errors.unauthorized")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("errors.unauthorizedMessage")}
          </p>
          <Button asChild className="mt-4">
            <Link to={`/auth?next=${encodeURIComponent(currentPath)}`}>{t("auth.signIn")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">{t("cliAuth.approveCliAccess")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("cliAuth.localCliRequesting")}
        </p>

        <div className="mt-5 space-y-3 text-sm">
          <div>
            <div className="text-muted-foreground">{t("cliAuth.command")}</div>
            <div className="font-mono text-foreground">{challenge.command}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("cliAuth.client")}</div>
            <div className="text-foreground">{challenge.clientName ?? "paperclipai cli"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t("cliAuth.requestedAccess")}</div>
            <div className="text-foreground">
              {challenge.requestedAccess === "instance_admin_required" ? t("cliAuth.instanceAdmin") : t("sidebar.board")}
            </div>
          </div>
          {challenge.requestedCompanyName && (
            <div>
              <div className="text-muted-foreground">{t("cliAuth.requestedCompany")}</div>
              <div className="text-foreground">{challenge.requestedCompanyName}</div>
            </div>
          )}
        </div>

        {(approveMutation.error || cancelMutation.error) && (
          <p className="mt-4 text-sm text-destructive">
            {(approveMutation.error ?? cancelMutation.error) instanceof Error
              ? ((approveMutation.error ?? cancelMutation.error) as Error).message
              : t("errors.serverError")}
          </p>
        )}

        {!challenge.canApprove && (
          <p className="mt-4 text-sm text-destructive">
            {t("cliAuth.requiresInstanceAdminSignIn")}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={!challenge.canApprove || approveMutation.isPending || cancelMutation.isPending}
          >
            {approveMutation.isPending ? t("app.loading") : t("cliAuth.approveCliAccessButton")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={approveMutation.isPending || cancelMutation.isPending}
          >
            {cancelMutation.isPending ? t("app.loading") : t("app.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
