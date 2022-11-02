import { useState } from "react";
import useSWR from "swr";
import CreateCar from "../components/CreateCar";

const fetcher = (...args: [RequestInfo | URL, RequestInit]) =>
  fetch(...args).then((res) => res.json());
export default function CarListPage() {
  const { data, error } = useSWR("http://localhost:3000/cars", fetcher);
  return (
    <>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CarList />
        </div>
      </div>
    </>
  );
}

const people = [
  {
    name: "Lindsay Walton",
    title: "Front-end Developer",
    email: "lindsay.walton@example.com",
    role: "Member",
  },
  // More people...
];

function CarList() {
  const { data, error, mutate } = useSWR<any[]>(
    "http://localhost:3000/cars",
    fetcher
  );
  const [creatingCar, setCreatingCar] = useState(false);
  const [updatingCar, setUpdatingCar] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any | null>(null);
  return (
    <>
      <CreateCar
        onMutated={() => mutate()}
        mode="create"
        open={creatingCar}
        setOpen={setCreatingCar}
      />
      <CreateCar
        onMutated={() => mutate()}
        mode="edit"
        open={updatingCar}
        setOpen={setUpdatingCar}
        defaultValues={selectedCar}
      />
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Coches</h1>
            <p className="mt-2 text-sm text-gray-700">
              Lista con todos los coches de la base de datos blockchain.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={() => setCreatingCar(true)}
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
            >
              Crear coche
            </button>
          </div>
        </div>
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle">
              <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 lg:pl-8"
                      >
                        ID
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Brand
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Model
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Colour
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                      >
                        Owner
                      </th>
                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-6 lg:pr-8"
                      >
                        <span className="sr-only">Edit</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {data &&
                      data.map((car) => (
                        <tr key={car.Key}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 lg:pl-8">
                            {car.Key}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {car.Record.make}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {car.Record.model}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {car.Record.colour}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {car.Record.owner}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 lg:pr-8">
                            <button
                              onClick={() => {
                                setSelectedCar({
                                  identificador: car.Key,
                                  marca: car.Record.make,
                                  modelo: car.Record.model,
                                  color: car.Record.colour,
                                  propietario: car.Record.owner,
                                });
                                setUpdatingCar(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Edit<span className="sr-only">, {car.name}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
