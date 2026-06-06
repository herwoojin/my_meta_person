import { AlertTriangle } from "lucide-react";

export function LegalDisclaimer() {
  return (
    <div className="mt-8 p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
      <div className="flex gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground mb-1">면책 고지 (Disclaimer)</p>
          <p>
            본 앱(MetaMe)에서 AI 코치가 제공하는 모든 정보 및 제안은 참고용일 뿐이며, 
            전문적인 의학적 진단, 심리 상담, 법률 또는 투자 자문을 대신할 수 없습니다. 
            중요한 결정이나 건강, 재무적 문제에 대해서는 반드시 관련 전문가와 상담하시기 바랍니다.
          </p>
        </div>
      </div>
    </div>
  );
}
