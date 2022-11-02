import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  LinkIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/20/solid";
import TextField from "./forms/inputs/TextField";
import { FormProvider, useForm } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import SubmitButton from "./SubmitButton";

interface CreateCarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  defaultValues?: CreateCarForm;
  mode: "create" | "edit";
  onMutated: (data: any) => void;
}
interface CreateCarForm {
  identificador: string;
  marca: string;
  modelo: string;
  color: string;
  propietario: string;
}
export const createCarSchema = yup.object().shape({
  identificador: yup.string().required(),
  marca: yup.string().required(),
  modelo: yup.string().required(),
  color: yup.string().required(),
  propietario: yup.string().required(),
});
export default function CreateCar({
  open,
  onMutated,
  setOpen,
  defaultValues = {
    identificador: "",
    marca: "",
    modelo: "",
    color: "",
    propietario: "",
  },
  mode = "create",
}: CreateCarProps) {
  const methods = useForm({
    defaultValues,
    resolver: yupResolver(createCarSchema),
  });
  useEffect(() => {
    if (defaultValues) {
      methods.setValue("identificador", defaultValues.identificador);
      methods.setValue("marca", defaultValues.marca);
      methods.setValue("modelo", defaultValues.modelo);
      methods.setValue("color", defaultValues.color);
      methods.setValue("propietario", defaultValues.propietario);
    }
  }, [defaultValues]);
  const [creatingCar, setCreatingCar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = useCallback(async (values) => {
    setCreatingCar(true);
    try {
      const postData = {
        carId: values.identificador,
        make: values.marca,
        model: values.modelo,
        colour: values.color,
        owner: values.propietario,
      };
      await fetch("http://localhost:3000/cars", {
        method: "POST",
        body: JSON.stringify(postData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      setOpen(false);
      onMutated(postData);
    } catch (e) {
      setError(e!.toString());
    } finally {
      setCreatingCar(false);
    }
  }, []);
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <FormProvider {...methods}>
                    <form
                      onSubmit={methods.handleSubmit(onSubmit as any)}
                      className="flex h-full flex-col divide-y divide-gray-200 bg-white shadow-xl"
                    >
                      <div className="h-0 flex-1 overflow-y-auto">
                        <div className="bg-indigo-700 py-6 px-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <Dialog.Title className="text-lg font-medium text-white">
                              {mode === "create" && "Crear coche"}
                              {mode === "edit" && "Actualizar coche"}
                            </Dialog.Title>
                            <div className="ml-3 flex h-7 items-center">
                              <button
                                type="button"
                                className="rounded-md bg-indigo-700 text-indigo-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                                onClick={() => setOpen(false)}
                              >
                                <span className="sr-only">Close panel</span>
                                <XMarkIcon
                                  className="h-6 w-6"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div className="divide-y divide-gray-200 px-4 sm:px-6">
                            <div className="space-y-6 pt-6 pb-5">
                              {error && (
                                <div className="rounded-md bg-red-50 p-4">
                                  <div className="flex">
                                    <div className="flex-shrink-0">
                                      <XMarkIcon
                                        className="h-5 w-5 text-red-400"
                                        aria-hidden="true"
                                      />
                                    </div>
                                    <div className="ml-3">
                                      <h3 className="text-sm font-medium text-red-800">
                                        Error
                                      </h3>
                                      <div className="mt-2 text-sm text-red-700">
                                        <p>{error}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <TextField
                                label="Identificador"
                                name="identificador"
                                register={methods.register}
                              />
                              <TextField
                                label="Marca"
                                name="marca"
                                register={methods.register}
                              />
                              <TextField
                                label="Modelo"
                                name="modelo"
                                register={methods.register}
                              />
                              <TextField
                                label="Color"
                                name="color"
                                register={methods.register}
                              />
                              <TextField
                                label="Propietario"
                                name="propietario"
                                register={methods.register}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 justify-end px-4 py-4">
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          onClick={() => setOpen(false)}
                        >
                          Cancelar
                        </button>
                        <SubmitButton
                          loading={creatingCar}
                          disabled={creatingCar}
                          className="ml-4 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                                                        {mode === "create" && "Crear"}
                              {mode === "edit" && "Actualizar"}
                        </SubmitButton>
                      </div>
                    </form>
                  </FormProvider>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
