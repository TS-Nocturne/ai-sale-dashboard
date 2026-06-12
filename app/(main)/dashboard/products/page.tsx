import { Metadata } from "next"
import ProductsContent from "./ProductsContent"
import { getProducts } from "./actions"

export const metadata: Metadata = {
    title: "สินค้า/บริการ",
    description: "จัดการรายการสินค้าและบริการ",
}

export default async function ProductsPage() {
    const products = await getProducts()
    return <ProductsContent initialProducts={products} />
}
