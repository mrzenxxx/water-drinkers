import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Схема → типы TypeScript. Результат коммитится, чтобы сборка не зависела
 * от запуска codegen. После правки schema.graphql: npm run codegen.
 */
const config: CodegenConfig = {
  overwrite: true,
  schema: 'src/graphql/schema.graphql',
  generates: {
    'src/graphql/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        contextType: '../context#GraphQLContext',
        /**
         * Мапперы: резолвер возвращает строку из базы, а вычисляемые поля
         * (`balance`, `isActive`, связи) доводит резолвер поля.
         * Без этого TypeScript требует от `me` вернуть сразу весь граф.
         *
         * Баланс, раскладка и доля приходят не из таблицы, а из ядра расчёта:
         * их родительский тип — результат `computeBalances`, а не строка базы.
         */
        mappers: {
          User: '@/generated/prisma/client#User as PrismaUser',
          Contribution: '@/generated/prisma/client#Contribution as PrismaContribution',
          WaterOrder: '@/generated/prisma/client#WaterOrder as PrismaWaterOrder',
          Absence: '@/generated/prisma/client#Absence as PrismaAbsence',
          Receipt: '@/generated/prisma/client#Receipt as PrismaReceipt',
          AuditEntry: '@/generated/prisma/client#AuditEntry as PrismaAuditEntry',
          AssistantMessage: '@/generated/prisma/client#AssistantMessage as PrismaAssistantMessage',
          Announcement: '@/generated/prisma/client#Announcement as PrismaAnnouncement',
          // Картинка собирается из колонок объявления, а не из строки таблицы
          // с байтами: наружу отдаются описание и ссылка, но не содержимое.
          AnnouncementImage: '@/lib/view/announcements#AnnouncementImageView',
          Fund: '@/lib/calc/types#FundSettings as CalcFundSettings',
          Balance: '@/lib/calc/types#Balance as CalcBalance',
          BalanceBreakdown: '@/lib/calc/types#BalanceBreakdown as CalcBalanceBreakdown',
          OrderShare: '@/lib/calc/types#OrderShare as CalcOrderShare',
        },
        // Money — копейки, целое число (CLAUDE.md, правило 2).
        scalars: {
          Date: 'string',
          DateTime: 'string',
          Money: 'number',
          JSON: 'unknown',
        },
      },
    },
  },
};

export default config;
