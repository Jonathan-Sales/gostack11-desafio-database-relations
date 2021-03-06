import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer does not exists');
    }

    const findProducts = await this.productsRepository.findAllById(products);
    const foundProductsIds = findProducts.map(product => product.id);

    const searchInexistentProducts = products.filter(
      product => !foundProductsIds.includes(product.id),
    );

    if (searchInexistentProducts.length) {
      throw new AppError(
        `This products are not registered: ${searchInexistentProducts[0].id}`,
      );
    }

    const findProductsWithInsuficientQuantity = products.filter(
      product =>
        (findProducts.find(prod => prod.id === product.id)?.quantity || 0) <
        product.quantity,
    );

    if (findProductsWithInsuficientQuantity.length) {
      throw new AppError(
        `The quantity ${findProductsWithInsuficientQuantity[0].quantity} is not sufficient for product ${findProductsWithInsuficientQuantity[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: findProducts.find(prod => prod.id === product.id)?.price || 0,
    }));

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: serializedProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        findProducts.filter(prod => prod.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
