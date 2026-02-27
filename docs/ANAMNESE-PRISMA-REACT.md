# Anamnese modular — Prisma + React (referência para backend/front separados)

Caso você monte um backend Node + Express + Prisma e um front React + TypeScript separados, use esta modelagem e estrutura como referência. O app atual (Supabase + vanilla JS) já implementa a lógica equivalente; este doc é para migração ou serviço paralelo.

---

## 1. Modelagem Prisma completa

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id   String @id @default(uuid())
  name String
  // ... outros campos
  anamnesisFuncoes    AnamnesisFuncao[]
  anamnesisFuncaoTipo AnamnesisFuncaoTipo[]
  anamnesisRegras     AnamnesisRegra[]
  anamnesisCatalogos  AnamnesisCatalogo[]
}

model AnamnesisTipo {
  id          String   @id // 'injetaveis' | 'corporal' | 'simples'
  nome        String
  descricao   String?
  risco       String   @default("medio") // alto | medio | baixo
  ordem       Int      @default(0)
  funcaoTipos AnamnesisFuncaoTipo[]
  regras      AnamnesisRegra[]
  catalogos   AnamnesisCatalogo[]
  registros   AnamnesisRegistro[]
}

model AnamnesisFuncao {
  id        String   @id @default(uuid())
  orgId     String   @map("org_id")
  nome      String
  slug      String
  ordem     Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  funcaoTipo AnamnesisFuncaoTipo?
  registros AnamnesisRegistro[]
}

model AnamnesisFuncaoTipo {
  id        String   @id @default(uuid())
  orgId     String   @map("org_id")
  funcaoId  String   @map("funcao_id")
  tipoId    String   @map("tipo_id")
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  funcao    AnamnesisFuncao @relation(fields: [funcaoId], references: [id], onDelete: Cascade)
  tipo      AnamnesisTipo @relation(fields: [tipoId], references: [id])
  @@unique([orgId, funcaoId])
}

model AnamnesisRegra {
  id                    String   @id @default(uuid())
  orgId                 String   @map("org_id")
  tipoId                String   @map("tipo_id")
  nome                  String?
  nivel                 String   // contraindicacao_absoluta | contraindicacao_relativa | alerta | info
  bloqueiaProcedimento   Boolean  @default(false) @map("bloqueia_procedimento")
  regra                 Json     @default("{}")
  ordem                 Int      @default(0)
  active                Boolean  @default(true)
  createdAt             DateTime @default(now()) @map("created_at")
  org                   Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  tipo                  AnamnesisTipo @relation(fields: [tipoId], references: [id], onDelete: Cascade)
}

model AnamnesisRegistro {
  id                  String    @id @default(uuid())
  orgId               String    @map("org_id")
  clientId            String    @map("client_id")
  funcaoId            String    @map("funcao_id")
  agendaId            String?   @map("agenda_id")
  tipoAnamnese        String?   @map("tipo_anamnese")
  conteudo            String    @default("")
  ficha               Json      @default("{}")
  fotos               Json      @default("[]")
  condutaTratamento   String?   @map("conduta_tratamento")
  resultadoResumo     String?   @map("resultado_resumo")
  scoreResult         Json?     @map("score_result")
  bloqueioProcedimento Boolean   @default(false) @map("bloqueio_procedimento")
  version             Int       @default(1)
  anthropometry      Json?     // peso, altura, IMC, RCQ, waist_height, classificacao_metabolica
  authorId            String?   @map("author_id")
  createdAt           DateTime  @default(now()) @map("created_at")
  funcao              AnamnesisFuncao @relation(fields: [funcaoId], references: [id])
  tipo                AnamnesisTipo? @relation(fields: [tipoAnamnese], references: [id])
  auditLogs           AnamnesisAuditLog[]
  assinaturas         AnamnesisAssinatura[]
}

model AnamnesisCatalogo {
  id        String   @id @default(uuid())
  orgId     String   @map("org_id")
  tipoId    String?  @map("tipo_id")
  slug      String
  nome      String
  options   Json     @default("[]")
  ordem     Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  tipo      AnamnesisTipo? @relation(fields: [tipoId], references: [id], onDelete: Cascade)
  @@unique([orgId, tipoId, slug])
}

model AnamnesisAuditLog {
  id         String   @id @default(uuid())
  orgId      String   @map("org_id")
  registroId String   @map("registro_id")
  action     String
  authorId   String?  @map("author_id")
  payload    Json?
  createdAt  DateTime @default(now()) @map("created_at")
  registro   AnamnesisRegistro @relation(fields: [registroId], references: [id], onDelete: Cascade)
}

model AnamnesisAssinatura {
  id         String   @id @default(uuid())
  registroId String   @map("registro_id")
  signerType String   @map("signer_type") // profissional | cliente | responsavel
  signerId   String?  @map("signer_id")
  clientId   String?  @map("client_id")
  signedAt   DateTime @default(now()) @map("signed_at")
  ipOrHash   String?  @map("ip_or_hash")
  registro   AnamnesisRegistro @relation(fields: [registroId], references: [id], onDelete: Cascade)
  @@unique([registroId, signerType])
}
```

---

## 2. Estrutura de pastas (Node + React)

```
backend/
  prisma/
    schema.prisma
  src/
    modules/
      anamnesis/
        anamnesis.controller.ts
        anamnesis.service.ts
        anamnesis-score.service.ts
        anamnesis-corporal.service.ts
        dto/
        anamnesis.routes.ts
    ...
frontend/
  src/
    features/
      anamnesis/
        components/
          AnamnesisForm.tsx          # wrapper por tipo
          AnamnesisInjetaveis.tsx
          AnamnesisCorporal.tsx      # antropometria + bioimpedância
          AnamnesisSimples.tsx
          AnamnesisScoreAlert.tsx    # exibe score e bloqueio
        hooks/
          useAnamnesisRegras.ts
          useAnamnesisScore.ts
        types/
        ...
```

---

## 3. Componente React dinâmico baseado no tipo

Exemplo: um container que escolhe o formulário pelo tipo e exibe o resultado do score.

```tsx
// AnamnesisForm.tsx
import React, { useState, useMemo } from 'react';
import { AnamnesisInjetaveis } from './AnamnesisInjetaveis';
import { AnamnesisCorporal } from './AnamnesisCorporal';
import { AnamnesisSimples } from './AnamnesisSimples';
import { AnamnesisScoreAlert } from './AnamnesisScoreAlert';
import { evaluateRegras } from '../api/anamnesis-score';
import type { AnamnesisTipoId } from '../types';

type Props = {
  tipoId: AnamnesisTipoId;
  clientId: string;
  funcaoId: string;
  onSave: (payload: AnamnesisPayload) => Promise<void>;
};

export function AnamnesisForm({ tipoId, clientId, funcaoId, onSave }: Props) {
  const [ficha, setFicha] = useState<Record<string, unknown>>({});
  const [anthropometry, setAnthropometry] = useState<Record<string, unknown> | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);

  const handleFichaChange = useCallback((next: Record<string, unknown>) => {
    setFicha(next);
    evaluateRegras({ ficha: next, anthropometry, tipoId }).then(setScoreResult);
  }, [anthropometry, tipoId]);

  const handleAnthropometryChange = useCallback((next: Record<string, unknown> | null) => {
    setAnthropometry(next);
    evaluateRegras({ ficha, anthropometry: next ?? undefined, tipoId }).then(setScoreResult);
  }, [ficha, tipoId]);

  const FormByType = useMemo(() => {
    switch (tipoId) {
      case 'injetaveis': return AnamnesisInjetaveis;
      case 'corporal': return AnamnesisCorporal;
      case 'simples': return AnamnesisSimples;
      default: return AnamnesisSimples;
    }
  }, [tipoId]);

  return (
    <div className="anamnesis-form">
      <FormByType
        ficha={ficha}
        anthropometry={anthropometry}
        onFichaChange={handleFichaChange}
        onAnthropometryChange={tipoId === 'corporal' ? handleAnthropometryChange : undefined}
      />
      {scoreResult && (
        <AnamnesisScoreAlert
          scoreResult={scoreResult}
          bloqueio={scoreResult.bloqueio}
        />
      )}
      <button
        type="button"
        onClick={() => onSave({ ficha, anthropometry, scoreResult })}
        disabled={scoreResult?.bloqueio}
      >
        Salvar
      </button>
    </div>
  );
}
```

`AnamnesisCorporal` pode usar `buildAnthropometry(medidas)` (lógica igual à do `anamnesis-corporal.service.js`) e chamar `onAnthropometryChange` com o objeto calculado. O backend ou um hook pode chamar a API de score com `ficha` + `anthropometry` e exibir bloqueio/alerta antes de salvar.

---

## 4. Resumo

- **Prisma**: modelo acima espelha as tabelas do `supabase-anamnese-modular.sql` (AnamnesisTipo, Regra, Registro com score/anthropometry, Catalogo, AuditLog, Assinatura).
- **React**: formulário dinâmico por `tipoId` (injetaveis, corporal, simples), integração com motor de score e exibição de bloqueio.
- O app atual (Supabase + JS) já cobre a mesma lógica; use este doc para reimplementar em Node+React se precisar.
