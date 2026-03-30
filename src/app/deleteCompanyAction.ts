'use server';

import { db as adminDb } from '@/lib/firebase-admin';

// ---- Delete Company Action (by Master) ----

type DeleteCompanyState = {
  success?: boolean;
  error?: string;
};

export async function deleteCompany(
  companyId: string
): Promise<DeleteCompanyState> {
  try {
    if (!adminDb) {
      return { error: "O servico de banco de dados nao esta disponivel." };
    }

    if (!companyId) {
      return { error: "ID da empresa e obrigatorio." };
    }

    const companyRef = adminDb.collection("companies").doc(companyId);

    // Check if company exists
    const companyDoc = await companyRef.get();
    if (!companyDoc.exists) {
      return { error: "Empresa nao encontrada." };
    }

    // Delete all subcollections first
    const subcollections = await companyRef.listCollections();
    for (const subcollection of subcollections) {
      const docs = await subcollection.listDocuments();
      for (const doc of docs) {
        await doc.delete();
      }
    }

    // Delete users associated with this company
    const usersSnapshot = await adminDb
      .collection("users")
      .where("companyId", "==", companyId)
      .get();

    const deleteUserPromises = usersSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(deleteUserPromises);

    // Delete the company document itself
    await companyRef.delete();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("Error in deleteCompany:", errorMessage);
    return { error: `Erro ao excluir empresa: ${errorMessage}` };
  }
}
