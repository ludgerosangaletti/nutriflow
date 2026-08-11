import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/admin/pacientes-presenciais/route.ts", import.meta.url), "utf8");
const manager = readFileSync(new URL("../app/admin/clientes/[email]/in-person-care-manager.tsx", import.meta.url), "utf8");
const edgeFunction = readFileSync(new URL("../supabase/functions/correct-patient-email/index.ts", import.meta.url), "utf8");

test("correção de e-mail preserva o paciente e atualiza referências legadas em lote", () => {
  for (const table of ["anamneses", "progress_photos", "patient_documents", "check_ins", "push_subscriptions", "patient_activation_messages", "appointment_change_requests", "goals", "goal_progress", "adjustment_requests"]) {
    assert.match(route, new RegExp(`\\"${table}\\"`));
  }
  assert.match(route, /env\.DB\.batch\(updates\)/);
  assert.match(route, /patient\.access-email\.corrected/);
  assert.match(route, /eq\(clients\.organizationId, nutriFlowContext\.organizationId\)/);
});

test("interface exige novo e-mail confirmado e redireciona para o mesmo prontuário", () => {
  assert.match(manager, /Corrigir e-mail de acesso/);
  assert.match(manager, /emailConfirmation/);
  assert.match(manager, /encodeURIComponent\(result\.nextEmail/);
});

test("identidade é alterada somente por função autenticada e admite compensação", () => {
  assert.match(edgeFunction, /auth\.getUser\(token\)/);
  assert.match(edgeFunction, /admin\.updateUserById/);
  assert.match(edgeFunction, /action\?: \"prepare\" \| \"finalize\" \| \"rollback\"/);
  assert.match(route, /action: \"rollback\"/);
  assert.match(edgeFunction, /Este e-mail já pertence a outra conta de acesso/);
});
