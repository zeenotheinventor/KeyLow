import { EditFoodScreen } from "./EditFoodScreen";

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <EditFoodScreen id={id} />;
}
