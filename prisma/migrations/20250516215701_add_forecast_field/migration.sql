/*
  Warnings:

  - You are about to drop the column `result` on the `WeatherQuery` table. All the data in the column will be lost.
  - Added the required column `forecast` to the `WeatherQuery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WeatherQuery" DROP COLUMN "result",
ADD COLUMN     "forecast" JSONB NOT NULL;
